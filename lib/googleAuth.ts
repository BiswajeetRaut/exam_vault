export const loadGapi = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = "https://apis.google.com/js/api.js"
      script.onload = resolve
      document.body.appendChild(script)
    })
  }