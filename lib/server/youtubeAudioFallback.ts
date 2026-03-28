import ytdl from "@distube/ytdl-core"

const MAX_AUDIO_BYTES = 24 * 1024 * 1024

export async function downloadYoutubeAudioBuffer(videoUrl: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0

    const stream = ytdl(videoUrl, {
      quality: "lowestaudio",
      filter: "audioonly",
      highWaterMark: 1 << 24,
    })

    stream.on("data", (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_AUDIO_BYTES) {
        stream.destroy(new Error("Audio too large for fallback transcription"))
        return
      }
      chunks.push(chunk)
    })

    stream.on("error", (err: unknown) => {
      reject(err instanceof Error ? err : new Error("Audio download failed"))
    })

    stream.on("end", () => {
      if (!chunks.length) {
        reject(new Error("No audio stream data received"))
        return
      }
      resolve(Buffer.concat(chunks))
    })
  })
}
