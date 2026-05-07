import { redirect } from 'next/navigation';

// V2: ruta legacy. El wizard unificado vive en /calificador/wizard.
// Cualquier deep-link viejo a /calificador/wizard/seleccionar se redirige
// para mantener una sola ruta canónica del wizard.
export default function SeleccionarLineaLegacyRedirect() {
  redirect('/calificador/wizard');
}
