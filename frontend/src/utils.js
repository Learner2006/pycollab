export const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export const ADJECTIVES = ['Purple', 'Silent', 'Cosmic', 'Rusty', 'Lazy', 'Spicy', 'Frozen', 'Golden']
export const ANIMALS = ['Fox', 'Panda', 'Shark', 'Llama', 'Penguin', 'Raccoon', 'Otter', 'Cobra']

export function generateRoomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj} ${animal}`
}

export function showToast(msg, type = 'success') {
  const t = document.createElement('div')
  t.textContent = msg
  t.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    padding:10px 18px; border-radius:8px; font-size:14px;
    color:white; opacity:0; transition:opacity 0.3s;
    background:${type === 'error' ? '#ef4444' : type === 'warn' ? '#f97316' : '#22c55e'};
  `
  document.body.appendChild(t)
  requestAnimationFrame(() => t.style.opacity = 1)
  setTimeout(() => { 
    t.style.opacity = 0
    setTimeout(() => t.remove(), 300) 
  }, 2500)
}