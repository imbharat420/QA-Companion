/**
 * THE PROJECTS BARREL — the `/` landing screen's own composites.
 *
 * The page imports from here, never from a file inside, so a piece can be
 * split or re-shaped without touching the route.
 */

export { ProjectCard, projectGradient, type ProjectCardProps } from "./ProjectCard";
export { ProjectDetail, type ProjectDetailProps } from "./ProjectDetail";
export {
  ProjectSidebar,
  QUICK_VIEWS,
  isQuickView,
  type ProjectSidebarProps,
  type QuickView,
} from "./ProjectSidebar";
export { UploadDropzone, type UploadDropzoneProps } from "./UploadDropzone";
