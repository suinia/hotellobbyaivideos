export const HOTEL_LOBBY_DIRECTION_OPTIONS = [
  { id: "hotel-scene", title: "Scene", choices: [
    { value: "orange-studio", label: "Orange studio" },
    { value: "hotel-lobby", label: "Hotel lobby" },
    { value: "rooftop", label: "Rooftop" },
    { value: "recording-studio", label: "Recording studio" }
  ] },
  { id: "hotel-camera", title: "Camera", choices: [
    { value: "locked", label: "Fixed camera" },
    { value: "push-in", label: "Slow push-in" },
    { value: "orbit", label: "Slow orbit" },
    { value: "handheld", label: "Handheld" }
  ] },
  { id: "hotel-style", title: "Visual style", choices: [
    { value: "realistic", label: "Realistic" },
    { value: "cinematic", label: "Cinematic" },
    { value: "retro-film", label: "Retro film" },
    { value: "music-video", label: "Music video" }
  ] },
  { id: "hotel-lighting", title: "Lighting", choices: [
    { value: "soft-front", label: "Soft front light" },
    { value: "warm", label: "Warm light" },
    { value: "neon", label: "Neon light" },
    { value: "blue-hour", label: "Blue hour" }
  ] },
  { id: "hotel-energy", title: "Performance energy", choices: [
    { value: "relaxed", label: "Relaxed" },
    { value: "confident", label: "Confident" },
    { value: "energetic", label: "High energy" },
    { value: "playful", label: "Playful" }
  ] }
] as const;

/** Only recognized, explicitly selected UI values become user-visible direction. */
export function getHotelLobbySelectedDirections(options: Record<string, string> = {}) {
  return HOTEL_LOBBY_DIRECTION_OPTIONS.flatMap((option) => {
    const choice = option.choices.find((item) => item.value === options[option.id]);
    return choice ? [{ id: option.id, title: option.title, label: choice.label }] : [];
  });
}

export type HotelLobbyCast = "duet" | "solo" | "pets";

export function normalizeHotelLobbyCast(value?: string): HotelLobbyCast {
  return value === "solo" || value === "pets" ? value : "duet";
}

export function getHotelLobbyUploadError(cast: HotelLobbyCast, count: number): string | undefined {
  const required = cast === "solo" ? 1 : 2;
  if (count === required) return undefined;
  return required === 1
    ? "Upload one photo for the solo performance. Remove the second photo or choose Duet."
    : "Upload two photos: the first performer goes on the left, the second on the right.";
}

/** The selected preset is visible user input. Continuations retain their own request and history. */
export function buildHotelLobbySubmittedInputText(params: {
  inputText: string;
  cast: HotelLobbyCast;
  isContinuation: boolean;
  selectedOptions?: Record<string, string>;
}): string {
  const selected = getHotelLobbySelectedDirections(params.selectedOptions);
  const directions = selected.length
    ? `My selected settings (override the preset; my written description takes priority if they conflict):\n${selected.map((item) => `${item.title}: ${item.label}`).join("\n")}`
    : "";
  if (params.isContinuation) return [directions, params.inputText.trim()].filter(Boolean).join("\n\n");
  const casting = params.cast === "solo"
    ? "Create a solo music-performance video using the subject in my uploaded photo."
    : params.cast === "pets"
      ? "Create a playful pet-duet music video using my two uploaded photos. Keep the first pet on the left and the second on the right; preserve each pet’s fur markings and natural anatomy."
      : "Create a duet music-performance video using my two uploaded photos. Keep the first subject on the left and the second on the right; preserve both identities, hairstyles, and outfits.";
  return [
    casting,
    "Hotel Lobby preset: a seamless orange studio with one microphone hanging from a cable, soft frontal lighting, and a steady medium-wide camera. Keep faces clear and subjects separate. Use expressive rap-style mouth movements, relaxed head nods, and small natural gestures below the face. " + (params.cast === "solo" ? "The performer leans toward the microphone with confident performance energy." : "The left subject leads, the right reacts, then they exchange roles."),
    "Keep the cast and set consistent throughout. Use original instrumental hip-hop audio, without copying an existing song or singer’s voice. No added captions or logos.",
    directions,
    params.inputText.trim() ? `My adjustments to this preset (take priority): ${params.inputText.trim()}` : ""
  ].filter(Boolean).join("\n\n");
}
