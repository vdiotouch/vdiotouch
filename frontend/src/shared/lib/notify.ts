import type { MessageInstance } from "antd/es/message/interface";

// AntD `message` from <App>, reachable from mutation callbacks and other code
// that is not a component. <MessageBridge> (src/app/providers.tsx) fills it in.
let instance: MessageInstance | null = null;

export function setMessageInstance(next: MessageInstance | null) {
  instance = next;
}

export const notify = {
  success: (content: string) => void instance?.success(content),
  error: (content: string) => void instance?.error(content),
  info: (content: string) => void instance?.info(content),
};
