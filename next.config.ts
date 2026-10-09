import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image (VPS) ships the minimal standalone server; Vercel builds normally.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  // The app lives under /workspace. Older /projects, /organization and /profile URLs
  // (bookmarks, old emails) are sent to their current equivalents. Most specific first.
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      to("/projects", "/workspace/projects"),
      to("/projects/new", "/workspace/projects"),
      to("/projects/:projectId/overview", "/workspace/projects/:projectId"),
      to("/projects/:projectId/sprint", "/workspace/projects/:projectId/sprints"),
      to("/projects/:projectId/features", "/workspace/projects/:projectId/roadmap"),
      to("/projects/:projectId/modules", "/workspace/projects/:projectId/roadmap"),
      to("/projects/:projectId/:path*", "/workspace/projects/:projectId/:path*"),
      to("/organization/settings", "/workspace/settings"),
      to("/organization/standards", "/workspace/settings"),
      to("/organization/:path*", "/workspace/organization"),
      to("/profile", "/workspace/settings"),
    ];
  },
};

export default nextConfig;
