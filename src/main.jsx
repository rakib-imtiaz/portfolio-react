import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// No <StrictMode>: it mounts effects twice in development, and a WebGL canvas cannot be handed to a second renderer.
createRoot(document.getElementById('root')).render(<App />);
