import { describe, expect, it, vi } from "vitest";
import { createTelegramBotApiHttpEdge } from "./telegram-http-edge.js";
import type {
  ChannelHttpTransport,
  RedactedCredentialSecret,
} from "./whatsapp-http-edge.js";

const token = "123456:telegram-secret";
const secret: RedactedCredentialSecret = {
  use(callback) {
    return callback(token);
  },
};

describe("Telegram Bot API HTTP edge", () => {
  it("sends to token-scoped Bot API method and returns accepted body", async () => {
    const request=vi.fn(async()=>({
      statusCode:200,
      body:{ok:true,result:{message_id:42,date:1791300000}},
    }));
    const edge=createTelegramBotApiHttpEdge({
      botToken:secret,
      transport:{request},
    });

    await expect(edge.call({
      method:"sendMessage",
      body:{chat_id:123,text:"hello"},
    })).resolves.toMatchObject({status:"accepted"});

    expect(request.mock.calls[0]![0].url)
      .toBe(`https://api.telegram.org/bot${token}/sendMessage`);
  });

  it("maps Bot API error body to safe provider code", async () => {
    const edge=createTelegramBotApiHttpEdge({
      botToken:secret,
      transport:{
        async request(){
          return {
            statusCode:400,
            body:{ok:false,error_code:429,description:"private detail"},
          };
        },
      },
    });

    await expect(edge.call({
      method:"sendMessage",body:{chat_id:123,text:"hello"}
    })).resolves.toEqual({
      status:"rejected",
      safeCode:"telegram_429",
    });
  });

  it("treats ok:false as rejection even on a 2xx HTTP response", async () => {
    const edge=createTelegramBotApiHttpEdge({
      botToken:secret,
      transport:{
        async request(){
          return {statusCode:200,body:{ok:false,error_code:400}};
        },
      },
    });
    await expect(edge.call({
      method:"sendVoice",body:{chat_id:123,voice:"file"}
    })).resolves.toEqual({
      status:"rejected",safeCode:"telegram_400"
    });
  });

  it("redacts token-bearing transport failures", async () => {
    const transport:ChannelHttpTransport={
      async request(input){
        throw new Error(`network failed at ${input.url}`);
      },
    };
    const edge=createTelegramBotApiHttpEdge({
      botToken:secret,
      transport,
    });

    try {
      await edge.call({method:"sendAudio",body:{chat_id:123,audio:"file"}});
      expect.unreachable();
    } catch(error) {
      expect(String(error)).toBe("Error: Telegram Bot API request failed");
      expect(String(error)).not.toContain(token);
    }
  });

  it("rejects oversized serialized request bodies before HTTP", async () => {
    const request=vi.fn(async()=>({statusCode:200,body:{ok:true}}));
    const edge=createTelegramBotApiHttpEdge({
      botToken:secret,
      transport:{request},
    });

    await expect(edge.call({
      method:"sendMessage",
      body:{chat_id:123,text:"x".repeat(300_000)},
    })).resolves.toEqual({
      status:"rejected",safeCode:"request_too_large"
    });
    expect(request).not.toHaveBeenCalled();
  });
});
