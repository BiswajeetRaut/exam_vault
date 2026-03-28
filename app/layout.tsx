import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"

export default function RootLayout({ children }: any) {
  return (
    <html lang="en">
      <head>
      <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}