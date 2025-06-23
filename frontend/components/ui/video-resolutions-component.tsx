import React from "react";
import { VideoDetails } from "@/api/graphql/types/video-details";
import { bytesToMegaBytes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface VideoResolutionsComponentProps {
  videoDetails: VideoDetails;
}

const VideoResolutionsComponent: React.FC<VideoResolutionsComponentProps> = ({
  videoDetails,
}) => {
  // Filter files to only include playlist files (not thumbnails)
  const resolutionFiles = videoDetails.files?.filter(
    (file) => file.type === "playlist"
  ) || [];

  // Sort by height (resolution) in ascending order (360p first, 720p last)
  const sortedFiles = [...resolutionFiles].sort((a, b) => a.height - b.height);

  // Calculate total size of all resolution files
  const totalSize = sortedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Resolutions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedFiles.length > 0 ? (
            <>
              {sortedFiles.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-lg font-medium">{file.height}X{file.width}</div>
                    <Badge
                      variant={
                        file.latest_status === "READY" ? "default" : "secondary"
                      }
                    >
                      {file.latest_status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {bytesToMegaBytes(file.size)} MB
                  </div>
                </div>
              ))}

              {/* Total size section */}
              <Separator className="my-2" />
              <div className="flex justify-between items-center p-3">
                <div className="font-semibold">Total Size</div>
                <div className="text-sm font-medium">
                  {bytesToMegaBytes(totalSize)} MB
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No resolution information available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoResolutionsComponent;
