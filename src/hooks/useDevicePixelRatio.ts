import { useEffect, useState } from 'react';

export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() =>
    typeof window !== 'undefined' ? window.devicePixelRatio : 1
  );

  useEffect(() => {
    const query = matchMedia('(resolution: ' + window.devicePixelRatio + 'dppx)');
    const handler = () => setDpr(window.devicePixelRatio);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return dpr;
}
