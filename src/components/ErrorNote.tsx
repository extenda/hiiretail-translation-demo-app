export function ErrorNote({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p role="alert">{message}</p>;
}
