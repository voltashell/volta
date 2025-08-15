export async function GET() {
  return new Response('Socket.IO server is running on the main server', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}