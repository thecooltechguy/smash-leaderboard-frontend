import { getCharacterIconUrl } from "@/utils/characterMapping";
import React from "react";

interface CharacterIconProps {
  characterName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  alt?: string;
}

const CharacterIcon: React.FC<CharacterIconProps> = ({
  characterName,
  size = "md",
  className = "",
  alt,
}) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <img
      src={getCharacterIconUrl(characterName)}
      alt={alt || `${characterName} icon`}
      className={`${sizeClasses[size]} object-contain ${className}`}
      onError={(e) => {
        // Fallback to Mario icon if the character icon fails to load
        const target = e.target as HTMLImageElement;
        target.src = "/images/svgs/mario.svg";
      }}
    />
  );
};

export default CharacterIcon;
