"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "investor-agent-theme";

// Dark by default; the choice is remembered per browser.
export default function ThemeToggle() {
    const [dark, setDark] = useState(true);

    useEffect(() => {
        setDark(document.documentElement.classList.contains("dark"));
    }, []);

    const toggle = () => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
            localStorage.setItem(THEME_KEY, next ? "dark" : "light");
        } catch {
            // Storage blocked: the theme still applies for this visit.
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-md border p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
    );
}
