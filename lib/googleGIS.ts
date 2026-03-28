export const getAccessToken = () => {
    return new Promise<string>((resolve, reject) => {
  
      const g = window.google?.accounts?.oauth2
      if (!g) {
        reject("Google not loaded")
        return
      }

      const client = g.initTokenClient({
        client_id: "596682584149-72an4nu0pet7c6pv2464blaiq37djc0d.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response: { error?: string; access_token?: string }) => {
          if (response.error) {
            reject(response)
          } else if (response.access_token) {
            resolve(response.access_token)
          } else {
            reject(new Error("No access token"))
          }
        },
      })
  
      client.requestAccessToken()
    })
  }