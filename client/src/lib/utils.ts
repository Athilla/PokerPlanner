import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate Fibonacci sequence for voting scales
export function generateFibonacciScale(): number[] {
  return [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
}

// Format date to localized string based on language
export function formatDate(date: Date | string, locale: string = 'fr-FR'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// Generate initials from a name/alias
export function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

// Generate a random color from a list of predefined colors for user avatars
export function getRandomColor(id: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-red-500",
    "bg-yellow-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-cyan-500"
  ];
  
  // Use the string to generate a consistent index
  const charSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
}

// Get the average of an array of numbers
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  return sum / numbers.length;
}

// Calculate final estimate (round up to next value in scale)
export function calculateFinalEstimate(values: number[], scale: number[]): number {
  if (values.length === 0) return 0;
  
  const avg = calculateAverage(values);
  
  // Find the next value in the scale that is >= avg
  for (const value of scale) {
    if (value >= avg) {
      return value;
    }
  }
  
  // If no higher value found, return the highest in the scale
  return scale[scale.length - 1];
}

// Check if URL is absolute (for link copying)
export function isAbsoluteUrl(url: string): boolean {
  return /^(?:[a-z+]+:)?\/\//i.test(url);
}

// Generate a session link
export function getSessionLink(sessionId: string): string {
  const basePath = window.location.origin;
  return `${basePath}/join/${sessionId}`;
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy text: ", error);
    return false;
  }
}

// Parse JSON stored in string safely
export function safeJSONParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return fallback;
  }
}
