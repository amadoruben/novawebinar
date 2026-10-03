/*
 * Design system Convertewebinar — ponto de entrada único.
 * Referência visual oficial: ./convertewebinar-design (tokens, guidelines,
 * components, ui_kits). Tokens em src/styles.css (importados de lá).
 *
 * Core      Button, Input, Tag (= Badge) em components/ui · IconButton, Chip
 * Navegação NavTabs, Breadcrumb, PageHeader, SideRail, BottomNav
 * Dados     WidgetCard, Metric, ProgressRow, Avatar, AvatarStack, EmptyState
 * Gráficos  BarChart, LineChart, RangeChart, Heatmap
 * Diagrama  FlowNode, FlowTile, ChannelChip, BranchLabel, RunState
 */
export { Button, buttonVariants } from "@/components/ui/button";
export { Input } from "@/components/ui/input";
export { Badge, Badge as Tag, badgeVariants } from "@/components/ui/badge";
export { IconButton, Chip, type IconButtonTone } from "./core";
export { NavTabs, Breadcrumb, PageHeader, SideRail, BottomNav, type Crumb, type NavTabItem, type RailItem } from "./navigation";
export { WidgetCard, Metric, ProgressRow, Avatar, AvatarStack, EmptyState, initialsOf, type WidgetAction } from "./data";
export { BarChart, LineChart, RangeChart, Heatmap, heatLevelOf, type BarDatum } from "./charts";
export {
  FlowNode,
  FlowTile,
  ChannelChip,
  BranchLabel,
  RunState,
  FLOW_KIND,
  FLOW_CHANNEL,
  type FlowKind,
  type FlowChannel,
} from "./flow";
