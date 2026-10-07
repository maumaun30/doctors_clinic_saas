import { Icon, type IconName } from "./icons";

// Page title block shared by every app page: icon tile (or a custom
// leading element such as an avatar), title, subtitle and actions.
export function PageHeader({
  icon, leading, title, sub, actions,
}: {
  icon?: IconName;
  leading?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {leading ?? (icon && <span className="page-icon"><Icon name={icon} /></span>)}
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}
