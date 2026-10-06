import net from "node:net";
import tls from "node:tls";

type Socket = net.Socket | tls.TLSSocket;

function replyReader(socket: Socket) {
  let buffer = "";
  let lines: string[] = [];
  const queued: string[] = [];
  const waiting: Array<{ resolve: (reply: string) => void; reject: (error: Error) => void }> = [];

  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    while (buffer.includes("\r\n")) {
      const boundary = buffer.indexOf("\r\n");
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        const reply = lines.join("\n");
        lines = [];
        const pending = waiting.shift();
        if (pending) pending.resolve(reply);
        else queued.push(reply);
      }
    }
  };
  const onError = (error: Error) => {
    for (const pending of waiting.splice(0)) pending.reject(error);
  };
  socket.on("data", onData);
  socket.on("error", onError);

  return {
    next: () => queued.length
      ? Promise.resolve(queued.shift() || "")
      : new Promise<string>((resolve, reject) => waiting.push({ resolve, reject })),
    close: () => {
      socket.off("data", onData);
      socket.off("error", onError);
    },
  };
}

function expect(reply: string, codes: number[]) {
  if (!codes.some((code) => reply.startsWith(String(code)))) {
    throw new Error("SMTP " + reply.split("\n").at(-1));
  }
  return reply;
}

async function connected(socket: Socket, event: "connect" | "secureConnect") {
  await new Promise<void>((resolve, reject) => {
    socket.once(event, resolve);
    socket.once("error", reject);
  });
}

async function command(socket: Socket, nextReply: () => Promise<string>, value: string, codes: number[]) {
  socket.write(value + "\r\n");
  return expect(await nextReply(), codes);
}

function mailbox(value: string) {
  return value.match(/<([^>]+)>/)?.[1] || value.trim();
}

function encoded(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

export async function sendSmtpEmail({ subject, text, messageId }: {
  subject: string;
  text: string;
  messageId?: string;
}) {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER || "";
  const password = process.env.SMTP_PASSWORD || "";
  const from = process.env.SMTP_FROM || user;
  const to = process.env.LEAD_NOTIFICATION_EMAIL || "";
  if (!host || !port || !user || !password || !from || !to) throw new Error("SMTP is not configured");

  let socket: Socket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });
  let reader = replyReader(socket);
  socket.setTimeout(15_000, () => socket.destroy(new Error("SMTP timeout")));
  await connected(socket, secure ? "secureConnect" : "connect");

  try {
    expect(await reader.next(), [220]);
    let ehlo = await command(socket, reader.next, "EHLO legservice.ru", [250]);
    if (!secure) {
      if (!/STARTTLS/i.test(ehlo)) throw new Error("SMTP server does not offer STARTTLS");
      await command(socket, reader.next, "STARTTLS", [220]);
      reader.close();
      socket = tls.connect({ socket, servername: host });
      socket.setTimeout(15_000, () => socket.destroy(new Error("SMTP timeout")));
      await connected(socket, "secureConnect");
      reader = replyReader(socket);
      ehlo = await command(socket, reader.next, "EHLO legservice.ru", [250]);
    }
    if (!/AUTH/i.test(ehlo)) throw new Error("SMTP server does not offer authentication");
    await command(socket, reader.next, "AUTH LOGIN", [334]);
    await command(socket, reader.next, Buffer.from(user).toString("base64"), [334]);
    await command(socket, reader.next, Buffer.from(password).toString("base64"), [235]);
    await command(socket, reader.next, `MAIL FROM:<${mailbox(from)}>`, [250]);
    await command(socket, reader.next, `RCPT TO:<${mailbox(to)}>`, [250, 251]);
    await command(socket, reader.next, "DATA", [354]);

    const headers = [
      `Date: ${new Date().toUTCString()}`,
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encoded(subject)}`,
      `Message-ID: <${messageId || `lead-${Date.now()}`}@legservice.ru>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(text),
      ".",
    ].join("\r\n");
    await command(socket, reader.next, headers, [250]);
    await command(socket, reader.next, "QUIT", [221]);
    return new Response(null, { status: 202 });
  } finally {
    reader.close();
    socket.destroy();
  }
}
