#! /bin/sh

AAC="-c:a aac -b:a 160k"
OPUS="-c:a libopus -b:a 100k"

H264="-c:v libx264 -b:v 6M"
VP9="-c:v libvpx-vp9 -b:v 4M"
AV1="-c:v libaom-av1 -strict experimental -b:v 2M"

SOURCE=$1

VCODEC=$AV1
ACODEC=$OPUS
CONTAINER="-f webm"
FILE=av1.webm

ffmpeg -y -loglevel warning -stats -i $SOURCE $VCODEC -pass 1 -an $CONTAINER /dev/null
ffmpeg -y -loglevel warning -stats -i $SOURCE $VCODEC -pass 2 $ACODEC $CONTAINER $FILE
#time ffmpeg -y -loglevel warning -i $SOURCE $VP9 -f webm vp9.webm
#ffmpeg -y -loglevel warning -i $SOURCE $AV1 -f webm av1.webm
