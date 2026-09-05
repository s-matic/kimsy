import { readUIMessageStream, type UIMessageChunk } from "ai";

function uiMessageChunks(response: Response) {
  if (!response.body) throw new Error("Kimsy received an empty streaming response.");
  const source = response.body;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      reader = source.getReader();
      void (async () => {
        const decoder = new TextDecoder();
        let buffer = "";

        const consumeEvent = (event: string) => {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!data || data === "[DONE]") return;
          try {
            controller.enqueue(JSON.parse(data) as UIMessageChunk);
          } catch {
            throw new Error("Kimsy received an invalid AI message stream.");
          }
        };

        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.search(/\r?\n\r?\n/);
            while (boundary !== -1) {
              const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
              consumeEvent(buffer.slice(0, boundary));
              buffer = buffer.slice(boundary + separator.length);
              boundary = buffer.search(/\r?\n\r?\n/);
            }
          }
          buffer += decoder.decode();
          if (buffer.trim()) consumeEvent(buffer);
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      })();
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}

export function readResponseUIMessageStream(response: Response) {
  return readUIMessageStream({
    stream: uiMessageChunks(response),
    terminateOnError: true,
  });
}
