import { toast } from "./toast";

export async function copyToClipboard(text: string, alertText = "Text copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.info(alertText);
  } catch {
    // fallback
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.info(alertText);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }
}
