export default function(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}
