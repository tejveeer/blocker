// Shared motion presets for a consistent, springy feel across the app.

export const easeOutExpo = [0.22, 1, 0.36, 1];

export const springSoft = { type: "spring", stiffness: 320, damping: 30, mass: 0.8 };

export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.32, ease: easeOutExpo },
};

export const listContainer = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const listItem = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.2 } },
};

export const cardHover = {
  whileHover: { y: -2 },
  transition: springSoft,
};
