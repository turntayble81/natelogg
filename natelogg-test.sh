#! /bin/bash

i=0;

while [ true ]; do
	now=$(date)
    echo '{"name":"API","hostname":"c9804837f0b1","pid":3572,"level":30,"count":'$i',"metric":"rss","RSS":105,"elapsedTime":180,"MemFreed":-0.03,"msg":"Ran Garbage Collector.","time":"'$now'","v":0}' >> ./log/web-ui.log
    i=$((i+1));
    sleep 1;
done
