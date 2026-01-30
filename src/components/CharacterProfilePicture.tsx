import { characterToFileMapping, normalizeCharacterName } from "@/utils/characterMapping";
import React from "react";

interface CharacterProfilePictureProps {
  characterName: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  alt?: string;
}

const CharacterProfilePicture: React.FC<CharacterProfilePictureProps> = ({
  characterName,
  size = "md",
  className = "",
  alt,
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };

  // Get the file name from the mapping using proper normalization
  const normalizedName = normalizeCharacterName(characterName);
  const fileName = characterToFileMapping[normalizedName] || "mario";

  return (
    <img
      src={`/images/pngs/${fileName}.png`}
      alt={alt || `${characterName} profile picture`}
      className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-300 ${className}`}
      onError={(e) => {
        // Fallback to Mario if the character image fails to load
        const target = e.target as HTMLImageElement;
        target.src = "/images/pngs/mario.png";
      }}
    />
  );
};

export default CharacterProfilePicture;