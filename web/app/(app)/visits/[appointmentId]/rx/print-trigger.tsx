"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print" style={{ marginBottom: 12 }}>
      <button onClick={() => window.print()}>Print</button>
      <a href="javascript:history.back()" style={{ marginLeft: 12 }}>Back</a>
    </div>
  );
}
