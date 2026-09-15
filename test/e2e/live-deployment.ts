export function belongsToConvexDeployment(
  socketUrl: string,
  deploymentUrl: string,
) {
  const socket = new URL(socketUrl)
  const deployment = new URL(deploymentUrl)
  const socketProtocol = deployment.protocol === 'https:' ? 'wss:' : 'ws:'

  return socket.protocol === socketProtocol && socket.host === deployment.host
}
