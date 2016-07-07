var socket          = io();
var historyLength   = 0;
var maxHistoryLines = 1000;
var shell;

window.onload = function() {
    shell = $('#shell');

    $('#font-size').change(function() {
        shell.css('font-size', this.value + 'px');
    });

    $('#max-history-lines').change(function() {
        var val = parseInt(this.value);
        maxHistoryLines = val;
    });

    $('#logs input:checkbox').click(function() {
        var el      = $(this);
        var checked = el.prop('checked');
        var log     = el.attr('value');
        
        socket.emit('toggleLog', {
            log     : log,
            enabled : checked
        });        
    });

    $('#clear-history').click(function() {
        shell.html('');
    });

    $('#bunyan-options').click(function() {
        var win = $('#bunyan-options-window');
        if(win.dialog('isOpen')) {
            win.dialog('close');
        }else {
            win.dialog('open');
        }
    });

    $('#bunyan-options-window').dialog({
        autoOpen: false,
        dialogClass: 'noTitleStuff',
        position: { my: "left top", at: "left bottom", of: '#bunyan-options' },
        height: 250,
        width: 300,
        buttons: [{
            text: 'Save',
            click: function() {
                $( this ).dialog( "close" );
            }
        }, {
            text: 'Cancel',
            click: function() {
                $( this ).dialog( "close" );
            }
        }]
    }).dialog("widget").find(".ui-dialog-titlebar").hide();
};

socket.on('logData', function(data) {
    var el = shell.get(0);
    var scrollAtBottom = (el.scrollHeight == (el.offsetHeight + el.scrollTop)) ? true : false;
    var pre = document.createElement('pre');
    var removeLength;
    var n;

    if(historyLength >= maxHistoryLines) {
        removeLength = historyLength - maxHistoryLines;
        for(n=0; n<=removeLength; n++) {
            el.removeChild(el.children[0]);
            historyLength--;
        }
    }
    pre.innerHTML=data;
    el.appendChild(pre);
    historyLength++;

    if(scrollAtBottom) {
        el.scrollTop = el.scrollHeight;
    }
});
