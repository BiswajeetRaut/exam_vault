export const uploadToDrive = async (file: File, token: string) => {

  const metadata = {
    name: file.name,
    mimeType: file.type,
  }

  const form = new FormData()
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  )
  form.append("file", file)

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  )

  const data = await res.json()

  return {
    id: data.id,
    url: `https://drive.google.com/file/d/${data.id}/view`,
  }
}