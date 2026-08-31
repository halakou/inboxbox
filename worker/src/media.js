/** Pull Telegram file_id (never bytes) and optional forward source from a message. */

export function extractSave(message) {
  if (!message) return null;
  const cap = String(message.caption || "").slice(0, 200);

  const file = (obj, kind, label, mime) => {
    if (!obj || typeof obj.file_id !== "string") return null;
    return {
      file_id: obj.file_id,
      file_unique_id: obj.file_unique_id || null,
      kind,
      label: label || kind,
      mime: mime || obj.mime_type || null,
      bytes: Number(obj.file_size || 0),
      text_body: null,
    };
  };

  if (message.document) {
    return file(
      message.document,
      "document",
      message.document.file_name || cap || "document",
      message.document.mime_type,
    );
  }
  if (Array.isArray(message.photo) && message.photo.length) {
    const p = message.photo[message.photo.length - 1];
    return file(p, "photo", cap || "photo", "image/jpeg");
  }
  if (message.video) {
    return file(message.video, "video", message.video.file_name || cap || "video", message.video.mime_type);
  }
  if (message.audio) {
    return file(message.audio, "audio", message.audio.file_name || message.audio.title || cap || "audio", message.audio.mime_type);
  }
  if (message.voice) {
    return file(message.voice, "voice", cap || "voice", message.voice.mime_type);
  }
  if (message.animation) {
    return file(message.animation, "animation", message.animation.file_name || cap || "animation", message.animation.mime_type);
  }
  if (message.video_note) {
    return file(message.video_note, "video_note", "video_note", null);
  }
  if (message.sticker) {
    return file(message.sticker, "sticker", message.sticker.emoji || "sticker", null);
  }
  if (typeof message.text === "string" && message.text && !message.text.startsWith("/")) {
    const text = message.text.slice(0, 4096);
    return {
      file_id: null,
      file_unique_id: null,
      kind: "text",
      label: text.slice(0, 80),
      mime: "text/plain",
      bytes: 0,
      text_body: text,
    };
  }
  return null;
}

export function extractSource(message) {
  if (!message) return null;
  const origin = message.forward_origin;
  if (origin) {
    if (origin.type === "channel" && origin.chat) {
      const c = origin.chat;
      return {
        tgChatId: c.id,
        username: c.username || "",
        title: c.title || c.username || "channel",
        kind: "channel",
      };
    }
    if (origin.type === "user" && origin.sender_user) {
      const u = origin.sender_user;
      return {
        tgChatId: u.id,
        username: u.username || "",
        title: [u.first_name, u.last_name].filter(Boolean).join(" ") || "user",
        kind: "user",
      };
    }
    if (origin.type === "hidden_user") {
      return {
        tgChatId: null,
        username: "",
        title: origin.sender_user_name || "hidden",
        kind: "user",
      };
    }
    if ((origin.type === "chat" || origin.type === "channel") && origin.sender_chat) {
      const c = origin.sender_chat;
      return {
        tgChatId: c.id,
        username: c.username || "",
        title: c.title || c.username || "chat",
        kind: c.type || "chat",
      };
    }
  }
  if (message.forward_from_chat) {
    const c = message.forward_from_chat;
    return {
      tgChatId: c.id,
      username: c.username || "",
      title: c.title || c.username || "chat",
      kind: c.type || "channel",
    };
  }
  if (message.forward_from) {
    const u = message.forward_from;
    return {
      tgChatId: u.id,
      username: u.username || "",
      title: [u.first_name, u.last_name].filter(Boolean).join(" ") || "user",
      kind: "user",
    };
  }
  return null;
}

export function sendMethodForKind(kind) {
  switch (kind) {
    case "photo":
      return { method: "sendPhoto", field: "photo" };
    case "video":
      return { method: "sendVideo", field: "video" };
    case "document":
      return { method: "sendDocument", field: "document" };
    case "audio":
      return { method: "sendAudio", field: "audio" };
    case "voice":
      return { method: "sendVoice", field: "voice" };
    case "animation":
      return { method: "sendAnimation", field: "animation" };
    case "sticker":
      return { method: "sendSticker", field: "sticker" };
    case "video_note":
      return { method: "sendVideoNote", field: "video_note" };
    default:
      return null;
  }
}
