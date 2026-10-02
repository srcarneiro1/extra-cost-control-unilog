export async function copyTextToClipboard(text: string) {
  if (typeof document === 'undefined') return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback below covers browsers that block the async Clipboard API
    // after data loading or outside a secure clipboard context.
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  try {
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

export function reserveExternalWindow() {
  if (typeof window === 'undefined') return null
  const externalWindow = window.open('about:blank', '_blank')
  if (externalWindow) externalWindow.opener = null
  return externalWindow
}

export function navigateExternalWindow(externalWindow: Window | null, url: string) {
  if (externalWindow && !externalWindow.closed) {
    externalWindow.location.replace(url)
    return true
  }

  return Boolean(window.open(url, '_blank', 'noopener,noreferrer'))
}
