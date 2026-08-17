"use client";
import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  className = "",
  disabled = false,
}) => {
  const baseStyles =
    "px-4 py-2 bg-blue-600 text-white rounded-lg transition-opacity";

  const disabledStyles = disabled
    ? "opacity-50 cursor-not-allowed"
    : "hover:opacity-90";

  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`${baseStyles} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
};
