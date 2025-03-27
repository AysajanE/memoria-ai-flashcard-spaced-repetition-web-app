"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { FlashcardData } from "@/types";

interface ReviewCardProps {
  cardData: FlashcardData;
  index: number;
  onDelete: (index: number) => void;
  onUpdate: (index: number, updatedCard: FlashcardData) => void;
}

export function ReviewCard({ cardData, index, onDelete, onUpdate }: ReviewCardProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-1">Front</h3>
              <p className="text-base">{cardData.front}</p>
            </div>
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-1">Back</h3>
              <p className="text-base">{cardData.back}</p>
            </div>
            {/* Placeholder for editing inputs */}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDelete(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 