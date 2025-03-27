"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlashcardData } from "@/types";
import { Pencil, Trash2, Save, X } from "lucide-react";

interface ReviewCardProps {
  cardData: FlashcardData;
  index: number;
  onUpdate: (index: number, updatedCard: FlashcardData) => void;
  onDelete: (index: number) => void;
}

export function ReviewCard({ cardData, index, onUpdate, onDelete }: ReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editFront, setEditFront] = useState(cardData.front);
  const [editBack, setEditBack] = useState(cardData.back);

  const handleEdit = () => {
    setIsEditing(true);
    setEditFront(cardData.front);
    setEditBack(cardData.back);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    onUpdate(index, {
      front: editFront,
      back: editBack,
      type: cardData.type,
    });
    setIsEditing(false);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-medium text-gray-700">Front</h3>
          {isEditing ? (
            <Input
              value={editFront}
              onChange={(e) => setEditFront(e.target.value)}
              placeholder="Enter front text"
            />
          ) : (
            <p className="text-gray-600">{cardData.front}</p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="font-medium text-gray-700">Back</h3>
          {isEditing ? (
            <Input
              value={editBack}
              onChange={(e) => setEditBack(e.target.value)}
              placeholder="Enter back text"
            />
          ) : (
            <p className="text-gray-600">{cardData.back}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          {cardData.type && (
            <div className="text-sm text-gray-500">
              Type: {cardData.type}
            </div>
          )}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  className="flex items-center gap-1"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="flex items-center gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(index)}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
} 