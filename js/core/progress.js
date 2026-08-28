const STORAGE_KEY = 'goatProgress';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

let progress = loadProgress();

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function markVisited(conceptId) {
  progress[conceptId] = { ...progress[conceptId], visited: true };
  saveProgress();
}

export function markUnvisited(conceptId) {
  progress[conceptId] = { ...progress[conceptId], visited: false };
  saveProgress();
}

export function markQuizPassed(conceptId) {
  progress[conceptId] = { ...progress[conceptId], quizPassed: true };
  saveProgress();
}

export function isVisited(conceptId) {
  return Boolean(progress[conceptId]?.visited);
}
