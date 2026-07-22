import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left Pane - Branding & Visuals */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-secondary flex-col justify-between p-12 text-white">
        <div>
          <Image
            src="/logos/kpm/kpm-primary-white.svg"
            alt="KPM by Kapuletu"
            width={200}
            height={60}
            priority
          />
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Enterprise Project Management</h1>
          <p className="text-lg text-white/80">
            Streamline your organizational workflows, sprint execution, and team collaboration with KPM's highly structured ecosystem.
          </p>
        </div>
        <div className="text-sm text-white/60">
          © {new Date().getFullYear()} Kapuletu Systems. All rights reserved.
        </div>
      </div>

      {/* Right Pane - Auth Forms */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center bg-background px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
