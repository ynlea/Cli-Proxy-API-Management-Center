import { Navigate } from 'react-router-dom';

export function UsagePage() {
  return <Navigate to="/monitor?tab=trends" replace />;
}
