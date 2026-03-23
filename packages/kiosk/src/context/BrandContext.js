import { createContext, useContext } from 'react';

/**
 * BrandContext — provides the current active brand config to all screens.
 * Defined here (not in App.jsx) to prevent circular imports:
 *   App.jsx → renders screens → screens import useBrand from App.jsx → circular!
 */
export const BrandContext = createContext(null);
export const useBrand = () => useContext(BrandContext);
