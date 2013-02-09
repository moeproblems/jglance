/**
Copyright (C) 2011 by Mohammad "Moe" Hosseini (hosseini.moe@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/**
 * jGlance
 * Visit http://www.moewashere.com/jglance for demo, docs and guides.
 * @author Moe Hosseini
 * @version 0.1
 * @param args Settings to be passed for necessary data and customization
 */
var JGlance = function(args) {
    var settings = {
            data:   {},             // data object to be passed to each callback
            root:   $('body'),      // page root
            container:  null,       // jQuery object (or css selector) of area to render photos in
            baseHeight: 90,         // minimum initial height of photo
            maxHeight:  110,        // maximum initial height of photo
            resultItemCustomClass: '',  // custom css class that can be passed
            hoverAnimateSpeed:  100,    // how fast to blow up the hover div, in ms
            hoverInterval:      250,    // photo hover interval in ms
            fadeInSpeed:        350,    // fade in speed in ms
            enableHoverInfo:    false,  // hover info flag
            enableLightBox:     true,  // light box flag
            photoClickCallback: function(m, d){},   // callback for photo click
            lightBoxInfoCallback: function(m, d){}, // callback to get light box info
            hoverInfoCallback:  function(m, d){},   // callback to get hover info
            photoErrorCallback: function(m, i, d){},// callback when photo fails to load
            hoverInfoTransSpeed: 250,   // hover info fade in transition speed
            maxHoverWidth: 360,     // maximum width for hover state
            maxHoverHeight: 360,    // maximum height for hover state
            maxPerRow:          4   // minimum of 2 is enforced
        },
        root = null,
        clearClass = 'jg_clearfix',                 // css class name for clear fix
        resultRowClass = 'jg_result-row',           // css class name for result row
        resultItemClass = 'jg_result-item',         // css class name for each result element
        resultHoverClass = 'jg_result-hover',       // css class name for hover div
        hoverInfoClass = 'jg_hover-info',           // css class name for info area on hover
        lightBoxClass = 'jg_lightbox',              // css class name for light box
        lightBoxOverLay = 'jg_overlay',             // css class name for light box overlay
        lightBoxContainer = 'jg_lightbox-container',// css class name for light box container
        lightBoxLeftArrow = 'jg_left-arrow',        // css class name for light box left arrow
        lightBoxRightArrow = 'jg_right-arrow',      // css class name for light box right arrow
        lightBoxPhotoArea = 'jg_lightbox-photo',    // css class name for light box image area
        lightBoxInfoArea = 'jg_lightbox-info',      // css class name for light box info area
        lightBoxCloseClass = 'jg_close',            // css class name for light box close
        lightBoxCloseText = 'Close (esc)',          // text for light box close button
        baseMargin = 3, // base margin around each photo (we just care for left/right)
        resultHoverPadding = 10,    // hover padding in pixels
        resultHoverBorder = 1,      // hover border width in pixels
        windowPadding = 3,          // invisible view port padding in pixels
        fadeInClass = 'faded-in',   // opacity transition css class where supported
        fadeOutClass = 'faded-out', // faded out class, opacity = 0
        // array of interval speeds for fade in, in ms
        fadeInIntervals = [ 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750 ],
        cache = [], // array to hold all photos
        agreedHeight = Number.MAX_VALUE,  // height that all photos are to be set to initially, will be calculated
        baseHeight = 0,         // copy of settings.baseHeight
        maxHeight = 0,          // copy of settings.maxHeight
        containerWidth = 0,     // width of area
        maxPerRow = 2,          // copy of settings.maxPerRow
        transSupported = false, // css3 transition flag
        timeout = null,         // setTimeout reference
        hoverDiv = null,        // jQuery object for the hover area
        lightBox = null,        // jQuery object for light box area
        overlay = null,         // jQuery object for overlay
        container = null,       // jQuery object of render area
        currentIndex = -1,      // current photo index
        escapePress = function(c){},    // callback for hitting esc key
        leftPress = function(c){},      // callback for hitting left arrow key
        rightPress = function(c){};     // callback for hitting right arrow key

    $.extend( settings, args );

    /**
     * Key press closure
     * @param key Key code
     */
    var keyPressed = function(key) {
        return function(callback) {
            $(document).bind('keyup', function(e) {
                if ( e.keyCode == key || e.which == key ) { callback(); }
            });
        }
    };

    /**
     * Callback for hitting esc key
     */
    var escapeCallback = function() {
        closeLightBox();
    };

    /**
     * Callback for hitting left key
     */
    var leftCallback = function() {
        if ( currentIndex == 0 ) { return; }
        swapPhoto( cache[--currentIndex] );
    };

    /**
     * Callback for hitting right key
     */
    var rightCallback = function() {
        if ( currentIndex + 1 == cache.length ) { return; }
        swapPhoto( cache[++currentIndex] );
    };

    /**
     * Initialize the basic settings and params for internal use
     */
    var initSettings = function() {
        container = typeof settings.container == 'string' ? $(settings.container) : settings.container;
        containerWidth = container.width();
        baseHeight = settings.baseHeight;
        maxHeight = settings.maxHeight;
        maxPerRow = Math.max( settings.maxPerRow, maxPerRow );
        root = settings.root;
        escapePress = keyPressed( 27 );
        leftPress = keyPressed( 37 );
        rightPress = keyPressed( 39 );
    };

    initSettings();

    // detect css3 transition support
    var d = document.createElement('div');
    d.setAttribute('style', 'transition:top 1s ease;-o-transition:top 1s ease;-webkit-transition:top 1s ease;-moz-transition:top 1s ease;');
    transSupported = !!(d.style.transition || d.style.oTransition || d.style.webkitTransition || d.style.MozTransition);

    /**
     * Callback for window resize
     */
    var windowResized = function() {
        if ( !overlay || !lightBox ) { return; }
        var d = $(document),
            w = $(window);
        overlay.css({ width: d.width(), height: d.height() });
        lightBox.css({ width: w.width(), height: w.height() });
    };

    /**
     * Closed (and removes) the light box
     */
    var closeLightBox = function() {
        if ( !overlay || !lightBox ) { return; }
        overlay.remove();
        lightBox.remove();
        overlay = lightBox = null;
        $(document).unbind('keyup');
    };

    /**
     * Creates the light box DOMs
     */
    var prepareLightBox = function() {
        var w = $(window),
            d = $(document);
        // prepare the overlay
        overlay = $('<div />')
                        .addClass( lightBoxOverLay )
                        .css({ width: w.width(), height: d.height() });
        // prepare the light box
        lightBox = $('<div />')
                        .addClass( lightBoxClass )
                        .css({ width: w.width(), height: w.height(), top: w.scrollTop() })
                        .append(
                            // the relative div
                            $('<div />')
                                .click( function () { closeLightBox(); } )
                                .append(
                                    // container
                                    $('<div />')
                                        .addClass( lightBoxContainer )
                                        // stop bubbling from here up
                                        .delegate( '*', 'click', function (e) { e.stopPropagation(); } )
                                        .append(
                                            // left arrow
                                            $('<a />').addClass( lightBoxLeftArrow + ( !transSupported ? ' forced' : '' ) ).click( function (e) { e.preventDefault(); leftCallback(); } ),
                                            // right arrow
                                            $('<a />').addClass( lightBoxRightArrow + ( !transSupported ? ' forced' : '' ) ).click( function (e) { e.preventDefault(); rightCallback(); } ),
                                            // photo area
                                            $('<div />')
                                                .addClass( lightBoxPhotoArea )
                                                .append(
                                                    $('<img />'),
                                                    $('<div />').addClass( lightBoxInfoArea ))),
                                    // close button
                                    $('<a />')
                                        .addClass( lightBoxCloseClass )
                                        .html( lightBoxCloseText )
                                        .click( function (e) { e.preventDefault(); closeLightBox(); } ) ));
        w.resize( windowResized );
        // assign key listeners
        escapePress( escapeCallback );
        leftPress( leftCallback );
        rightPress( rightCallback );
        root.append( overlay, lightBox );
    };

    /**
     * Swap the photo in light box
     * @param photo Photo being shown in light box
     */
    var swapPhoto = function(photo) {
        var leftArrow = lightBox.find( '.' + lightBoxLeftArrow );
        lightBox.end();
        var rightArrow = lightBox.find( '.' + lightBoxRightArrow );
        lightBox.end();
        var img = lightBox.find( '.' + lightBoxPhotoArea + ' > img' );
        lightBox.end();
        var info = lightBox.find( '.' + lightBoxInfoArea );
        lightBox.end();

        if ( currentIndex == 0 ) { leftArrow.hide(); }
        else if ( cache.length > 1 ) { leftArrow.show(); }
        if ( currentIndex + 1 == cache.length ) { rightArrow.hide(); }
        else if ( cache.length > 1 ) { rightArrow.show(); }

        img.attr( 'src', photo.large || photo.thumbnail );
        info.empty().append( settings.lightBoxInfoCallback( photo, settings.data ) );
    };

    /**
     * Prepare the light box and show it
     */
    var startLightBox = function() {
        currentIndex = $(this).data('index');
        var photo = cache[currentIndex];
        !lightBox && prepareLightBox();
        swapPhoto( photo );
    };

    /**
     * Creates the hover div
     * @param photo Photo object
     * @param index Index of the photo in cache
     * @param imgElem jQuery object of the image causing the hover
     */
    var initHoverDiv = function(photo, index, imgElem) {
        hoverDiv =  $('<div />')
                        .addClass( resultHoverClass )
                        .mouseleave( function () { imgElem.unbind('mouseleave'); mouseLeft(); } )
                        .append(
                            $('<div />')
                                .append(
                                    $('<img />')
                                        .data( 'index', index )
                                        .click( function () {
                                            settings.photoClickCallback(photo, settings.data);
                                            settings.enableLightBox && startLightBox.call(this); })));
        if ( settings.enableHoverInfo ) {
            hoverDiv.find('div:first-child')
                .append(
                    $('<div />')
                        .addClass( hoverInfoClass ))
                .end();
        }
        // prevent image from bubbling up mouse leave, prevents hover div auto close
        imgElem.mouseleave( function (e) { e.stopPropagation(); } );
        root.append( hoverDiv );
    };

    /**
     * Returns a random fade in value from the array of intervals
     */
    var getFadeInValue = function() {
        return fadeInIntervals[ Math.floor( Math.random() * fadeInIntervals.length ) ];
    };

    /**
     * Get the adjusted width from new height
     * @param photo Photo object to adjust
     * @param height New height to adjust width to
     */
    var getAdjustedWidth = function(photo, height) {
        return Math.floor( ( photo.width * height ) / photo.height );
    };

    /**
     * Get the adjusted height from new width
     * @param photo Photo object to adjust
     * @param width New width to adjust height to
     */
    var getAdjustedHeight = function(photo, width) {
        return Math.floor( ( photo.height * width ) / photo.width );
    };

    /**
     * Mouse enter event handler
     */
    var mouseEntered = function() {
        timeout && clearTimeout( timeout );
        hoverDiv && hoverDiv.remove();
        var $this = $(this);
        timeout = setTimeout(function () {
            var photo = cache[$this.data('index')],
            newWidth,
            newHeight,
            currentW = $this.width(),
            currentH = $this.height();
            if ( !photo ) { return; }
            if ( photo.width > photo.height ) {
                newWidth = Math.max ( currentW, settings.maxHoverWidth || photo.width );
                newHeight = getAdjustedHeight( photo, newWidth );
            } else {
                newHeight = Math.max ( currentH, settings.maxHoverHeight || photo.height );
                newWidth = getAdjustedWidth( photo, newHeight );
            }
            var w = $(window),
                o = $this.offset(),
                // these coordinates will place the div exactly on top of photo
                beforeTop = o.top - 2 * resultHoverPadding - resultHoverBorder,
                beforeLeft = o.left - 2 * resultHoverPadding - resultHoverBorder,
                afterTop = beforeTop - ( newHeight - currentH ) / 2,
                afterLeft = beforeLeft - ( newWidth - currentW ) / 2;
            // lazy way of making adjustments
            while ( afterTop++ + resultHoverPadding < w.scrollTop() + windowPadding ) {}
            while ( afterLeft++ + resultHoverPadding < windowPadding ) {}
            while ( afterTop-- + newHeight + 2 * resultHoverPadding + 2 * resultHoverBorder > w.scrollTop() + w.height() - windowPadding - resultHoverPadding ) {}
            while ( afterLeft-- + newWidth + 2 * resultHoverPadding + 2 * resultHoverBorder > w.width() - windowPadding - resultHoverPadding ) {}
            initHoverDiv( photo, $this.data('index'), $this );
            var img = hoverDiv.find('img');
            img.attr({
                src: $this.attr('src'),
                width: currentW,
                height: currentH });
            hoverDiv.end();
            var hoverInfo = settings.enableHoverInfo ? hoverDiv.find( '.' + hoverInfoClass ) : null;
            hoverInfo && hoverDiv.end();
            hoverInfo && hoverInfo.append( settings.hoverInfoCallback( photo, settings.data ) );
            hoverDiv.css({ top: beforeTop , left: beforeLeft }).show();
            img.animate({ width: newWidth, height: newHeight }, settings.hoverAnimateSpeed);
            hoverDiv.animate({ top: afterTop, left: afterLeft }, settings.hoverAnimateSpeed);
            if ( hoverInfo ) {
                if ( transSupported ) {
                    hoverInfo.addClass( fadeInClass );
                } else {
                    hoverInfo.fadeTo( settings.hoverInfoTransSpeed, 1 );
                }
            }
        }, settings.hoverInterval );
    };

    /**
     * Mouse left event handler
     */
    var mouseLeft = function() {
        // clear timeout
        timeout && clearTimeout( timeout );
        hoverDiv = ( ( hoverDiv && hoverDiv.remove() ), null );
    };

    // delegate mouseenter and mouseleave to container
    container
        .delegate( '.' + resultItemClass + ' img', 'mouseenter', mouseEntered )
        .delegate( '.' + resultItemClass + ' img', 'mouseleave', mouseLeft );

    /**
     * Create a jQuery DOM object for photo
     * @param photo Photo object to render
     */
    var getPhotoResult = function(photo, index) {
        return  $('<div />')
                    .addClass( resultItemClass + ( settings.resultItemCustomClass ? ' ' + settings.resultItemCustomClass : '' ) )
                    .data( 'height', photo.height )
                    .data( 'width', photo.width )
                    .append(
                        $('<img />')
                            .error( function () { settings.photoErrorCallback(photo, $(this), settings.data); })
                            .data( 'index', cache.length + index )
                            .css({ width: photo.adjustedWidth, height: photo.adjustedHeight })
                            .addClass( transSupported ? fadeOutClass : '' )
                            .click( function() {
                                settings.photoClickCallback(photo, settings.data);
                                settings.enableLightBox && startLightBox.call(this); })
                            .attr({
                                src:    photo.thumbnail })
                            .load(function() {
                                if ( !transSupported ) { return; }
                                var $this = $(this);
                                setTimeout( function() {
                                    if ( transSupported ) {
                                        $this.addClass( fadeInClass );
                                    } else {
                                        $this.fadeTo( settings.fadeInSpeed, 1 );
                                    }
                                }, getFadeInValue() );}));
    };

    /**
     * Adjust the row to fit the photo
     * @param ch Array (jQuery object) of photo row elements
     * @param diff Space left in pixels
     */
    var adjustRow = function(ch, diff) {
        if ( ch.length <= 1 ) { return; }
        var newHeight = agreedHeight,
            sum = 0;
        while ( diff > 0 ) {
            // increase height by 1px
            newHeight++;
            // figure out width increment with each height increment
            ch.each( function() {
                var $this = $(this),
                    newW = getAdjustedWidth( { width: $this.data('width'), height: $this.data('height') }, newHeight),
                    img = $this.find('img'),
                    imgWidth = img.width();
                diff -= newW - imgWidth;
                // set the photo's new width and height
                img.css({ width: diff > 0 ? newW : imgWidth , height: newHeight });
            });
        }
        // set last row element's class
        $(ch.get(-1)).addClass('last');
        // calculate remaining space, numbers are floored so there might be room
        ch.each( function(k) {
            var $this = $(this),
                img = $this.find('img');
            sum += ( k == 0 || $this.hasClass('last') ? 1 : 2 ) * baseMargin + img.width();
        });
        diff = containerWidth - sum;
        while( diff > 0 ) {
            ch.find('img').each( function() {
                if ( diff-- < 1 ) { return false; }
                $(this).css({ width: $(this).width() + 1 });
            });
        }
        return ch.find('img:eq(0)').height();
    };

    /**
     * Render photo objects
     * @param photos Array of photo objects
     */
    var renderPhotos = function(photos) {
        var div = $('<div />').addClass( resultRowClass + ' ' + clearClass ),
            sumWidth = 0,
            count = 0,
            lastRow = container.find( '.' + resultRowClass + ':last-child' ),
            rowClosed = lastRow.find( '.' + resultItemClass + ':last-child' ).hasClass('last');
        lastRow.end();
        container.end();
        // check if results already exist
        if ( lastRow.length == 1 && !rowClosed ) {
            // prepend the array with last result's photo to be re-rendered
            $(lastRow.find( '.' + resultItemClass ).get().reverse()).each(function (k) {
                photos.unshift( cache[ cache.length - 1 - k ] );
            });
            lastRow.remove();
        }
        $.each( photos, function(k, photo) {
            // adjust the width to match the agreed height
            var newW = getAdjustedWidth( photo, agreedHeight ),
                addition = newW + 2 * baseMargin,
                finalHeight;
            photo.adjustedWidth = newW;
            photo.adjustedHeight = agreedHeight;
            // check if room left for current photo
            if ( sumWidth + addition > containerWidth || count >= maxPerRow ) {
                // how much space left
                var diff = containerWidth - sumWidth + baseMargin,
                    ch = div.find( '.' + resultItemClass );
                finalHeight = adjustRow( ch, diff );
                div.css({ height: finalHeight });
                // add the current row to container
                container.append( div );
                // create new row
                div = $('<div />').addClass( resultRowClass + ' ' + clearClass );
                // reset sum and count
                sumWidth = 0;
                count = 0;
            }
            count++;
            sumWidth += addition;
            // add current photo to the row
            div.append( getPhotoResult( photo, k ) );

            // check if this is the last item
            if ( k == photos.length - 1 ) {
                var c = div.find( '.' + resultItemClass );
                finalHeight = agreedHeight;
                if ( c.length > maxPerRow / 2 ) {
                    // last row has at least half the allowed max
                    var tempSum = 0;
                    // calculate the sum of widths of current elements
                    c.each(function(k) {
                        tempSum += ( k == 0 || k == c.length - 1 ? 1 : 2 ) * baseMargin + $(this).find('img').width();
                    });
                    // adjust to fill row
                    finalHeight = adjustRow( c, containerWidth - tempSum );
                    // last element in row class
                    c.length == maxPerRow && $(c.get(-1)).addClass('last');
                }
                div.css({ height: finalHeight });
                container.append( div );
                container.end();
            }
        });
    };

    /**
     * Calculate a base height for photo
     */
    var calculateAgreedHeight = function() {
        $.each( cache, function( k, photo) {
            agreedHeight = Math.min( agreedHeight, photo.height );
        });
        agreedHeight = Math.min( Math.max( agreedHeight, baseHeight ), maxHeight );
    };

    /**
     * Public method to add more photo
     * @param photos Array of photos
     */
    this.push = function(photos) {
        agreedHeight == Number.MAX_VALUE && calculateAgreedHeight();
        renderPhotos( photos );
        $.merge( cache, photos );
        return this;
    };

    /**
     * Returns the current array of photo
     */
    this.getPhotos = function() {
        return cache;
    };

    /**
     * Update the settings
     * @param newSettings New settings object
     */
    this.updateSettings = function(newSettings) {
        $.extend( settings, newSettings );
        initSettings();
        return this;
    };

    /**
     * Reset the gallery
     */
    this.reset = function() {
        hoverDiv && hoverDiv.remove();
        container && container.children().remove().end();
        cache = [];
        return this;
    };

    /**
     * Redraws the current photos in the gallery
     */
    this.redraw = function() {
        hoverDiv && hoverDiv.remove();
        container && container.children().remove().end();
        renderPhotos( cache );
        return this;
    };
};
