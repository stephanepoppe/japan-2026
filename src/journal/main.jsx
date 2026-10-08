import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Journal from './Journal'
import '../styles.css'
import './journal.css'

// No "Save image" on right-click for journal photos, in the page or the gallery (see journal.css).
addEventListener('contextmenu', e => { if (e.target.closest?.('.photos, .pswp')) e.preventDefault() })

createRoot(document.getElementById('root')).render(<StrictMode><Journal /></StrictMode>)
