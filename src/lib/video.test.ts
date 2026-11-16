import { describe, expect, it } from "vitest";
import { videoEmbedUrl } from "./video";

describe("videoEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=12", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"],
    ["https://vimeo.com/channels/staffpicks/123456789", "https://player.vimeo.com/video/123456789"],
  ])("reconnaît %s", (input, expected) => {
    expect(videoEmbedUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "pas une adresse",
    "javascript:alert(1)",
    "https://exemple.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=<script>",
    "https://youtube.com.exemple.com/watch?v=dQw4w9WgXcQ",
  ])("refuse %s", (input) => {
    expect(videoEmbedUrl(input)).toBeNull();
  });
});
