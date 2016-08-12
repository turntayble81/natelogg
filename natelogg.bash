#! /bin/bash
end=$((SECONDS+10000000))

while [ $SECONDS -lt $end ]; do
    echo "testing $SECONDS" >> log/admin-api.log
    :
done
