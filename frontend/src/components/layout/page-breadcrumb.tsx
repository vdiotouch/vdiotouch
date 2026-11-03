import { Link } from "@tanstack/react-router";
import { Breadcrumb } from "antd";
import { breadcrumbsForPath } from "./navigation";

export function PageBreadcrumb({ pathname }: { pathname: string }) {
  const items = breadcrumbsForPath(pathname).map((crumb) => ({
    title: crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label,
  }));
  return <Breadcrumb items={items} />;
}
