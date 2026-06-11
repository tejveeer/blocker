import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

const ICONS = { light: Sun, dark: Moon };
const LABELS = { light: "Light theme", dark: "Dark theme" };

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const Icon = ICONS[resolvedTheme] ?? Monitor;

  // Toggle based on what's actually showing so the screen always flips on the
  // first click, regardless of the OS preference behind "system".
  const cycle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycle}
      aria-label={`Switch theme (currently ${LABELS[resolvedTheme]})`}
      title={LABELS[resolvedTheme]}
      className="relative overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolvedTheme}
          initial={{ y: -16, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 16, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center"
        >
          <Icon className="size-4" />
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
