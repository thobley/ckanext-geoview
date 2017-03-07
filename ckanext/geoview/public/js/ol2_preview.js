// Openlayers preview module

(function() {

    var $_ = _ // keep pointer to underscore, as '_' will may be overridden by a closure variable when down the stack

    this.ckan.module('olpreview', function (jQuery, _) {

        ckan.geoview = ckan.geoview || {}

        OpenLayers.Control.CKANLayerSwitcher = OpenLayers.Class(OpenLayers.Control.LayerSwitcher,
            {
                redraw: function () {
                    //if the state hasn't changed since last redraw, no need
                    // to do anything. Just return the existing div.
                    if (!this.checkRedraw()) {
                        return this.div;
                    }

                    //clear out previous layers
                    this.clearLayersArray("base");
                    this.clearLayersArray("data");

                    var containsOverlays = false;
                    var containsBaseLayers = false;

                    // Save state -- for checking layer if the map state changed.
                    // We save this before redrawing, because in the process of redrawing
                    // we will trigger more visibility changes, and we want to not redraw
                    // and enter an infinite loop.
                    this.layerStates = this.map.layers.map(function (layer) {
                        return {
                            'name': layer.name,
                            'visibility': layer.visibility,
                            'inRange': layer.inRange,
                            'id': layer.id
                        };
                    })

                    var layers = this.map.layers.slice().filter(function (layer) {
                        return layer.displayInLayerSwitcher
                    });
                    if (!this.ascending) {
                        layers.reverse();
                    }

                    for (var i = 0; i < layers.length; i++) {
                        var layer = layers[i];
                        var baseLayer = layer.isBaseLayer;

                        if (baseLayer) containsBaseLayers = true;
                        else containsOverlays = true;

                        // only check a baselayer if it is *the* baselayer, check data
                        //  layers if they are visible
                        var checked = (baseLayer) ? (layer == this.map.baseLayer) : layer.getVisibility();

                        // create input element
                        var inputElem = document.createElement("input"),
                        // The input shall have an id attribute so we can use
                        // labels to interact with them.
                            inputId = OpenLayers.Util.createUniqueID(this.id + "_input_");

                        inputElem.id = inputId;
                        inputElem.name = (baseLayer) ? this.id + "_baseLayers" : layer.name;
                        inputElem.type = (baseLayer) ? "radio" : "checkbox";
                        inputElem.value = layer.name;
                        inputElem.checked = checked;
                        inputElem.defaultChecked = checked;
                        inputElem.className = "olButton";
                        inputElem._layer = layer.id;
                        inputElem._layerSwitcher = this.id;
                        inputElem.disabled = !baseLayer && !layer.inRange;

                        // create span
                        var labelSpan = document.createElement("label");
                        // this isn't the DOM attribute 'for', but an arbitrary name we
                        // use to find the appropriate input element in <onButtonClick>
                        labelSpan["for"] = inputElem.id;
                        OpenLayers.Element.addClass(labelSpan, "labelSpan olButton");
                        labelSpan._layer = layer.id;
                        labelSpan._layerSwitcher = this.id;
                        if (!baseLayer && !layer.inRange) {
                            labelSpan.style.color = "gray";
                        }
                        labelSpan.innerHTML = layer.title || layer.name;
                        labelSpan.style.verticalAlign = (baseLayer) ? "bottom"
                            : "baseline";


                        var groupArray = (baseLayer) ? this.baseLayers
                            : this.dataLayers;
                        groupArray.push({
                            'layer': layer,
                            'inputElem': inputElem,
                            'labelSpan': labelSpan
                        });


                        var groupDiv = $((baseLayer) ? this.baseLayersDiv
                            : this.dataLayersDiv);
                        groupDiv.append($("<div></div>").append($(inputElem)).append($(labelSpan)));
                    }

                    // if no overlays, dont display the overlay label
                    this.dataLbl.style.display = (containsOverlays) ? "" : "none";

                    // if no baselayers, dont display the baselayer label
                    this.baseLbl.style.display = (containsBaseLayers) ? "" : "none";

                    return this.div;
                }
            }
        );


        ckan.geoview.layerExtractors = {

            'kml': function (resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var url = proxyUrl || resource.url;
                layerProcessor(OL_HELPERS.createKMLLayer(url));
            },
            'gml': function (resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var url = proxyUrl || resource.url;
                layerProcessor(OL_HELPERS.createGMLLayer(url));
            },
            'geojson': function (resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var url = proxyUrl || resource.url;
                //var url = resource.url;
		//console.log(url);
                layerProcessor(OL_HELPERS.createGeoJSONLayer(url));
            },
            'wfs': function(resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var parsedUrl = resource.url.split('#');
                var url = proxyServiceUrl || parsedUrl[0];

                var ftName = parsedUrl.length > 1 && parsedUrl[1];
                OL_HELPERS.withFeatureTypesLayers(url, layerProcessor, ftName);
            },
            'wms' : function(resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var parsedUrl = resource.url.split('#');
                // use the original URL for the getMap, as there's no need for a proxy for image requests
                var getMapUrl = parsedUrl[0];
				if (getMapUrl.indexOf('?')){
					var getMapUrl = getMapUrl.split('?')[0]; // revmoved query
				}


                var url = proxyServiceUrl || getMapUrl;

                var layerName = parsedUrl.length > 1 && parsedUrl[1];
                OL_HELPERS.withWMSLayers(url, getMapUrl, layerProcessor, layerName, true /* useTiling*/ );
            },
            'esrigeojson': function (resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var url = proxyUrl || resource.url;
                layerProcessor(OL_HELPERS.createEsriGeoJSONLayer(url));
            },
            'arcgis_rest': function(resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var parsedUrl = resource.url.split('#');
                var url = proxyServiceUrl || parsedUrl[0];

                var layerName = parsedUrl.length > 1 && parsedUrl[1];

                OL_HELPERS.withArcGisLayers(url, layerProcessor, layerName, parsedUrl[0]);
            },
            'gft': function (resource, proxyUrl, proxyServiceUrl, layerProcessor) {
                var tableId = OL_HELPERS.parseURL(resource.url).query.docid;
                layerProcessor(OL_HELPERS.createGFTLayer(tableId, ckan.geoview.gapi_key));
            }
        }

        var withLayers = function (resource, proxyUrl, proxyServiceUrl, layerProcessor) {

            var withLayers = ckan.geoview.layerExtractors[resource.format && resource.format.toLocaleLowerCase()];
            withLayers && withLayers(resource, proxyUrl, proxyServiceUrl, layerProcessor);
        }

        return {
            options: {
                i18n: {
                }
            },

            initialize: function () {
                jQuery.proxyAll(this, /_on/);
                this.el.ready(this._onReady);
            },

            addLayer: function (resourceLayer) {

                if (ckan.geoview && ckan.geoview.feature_style) {
                    var styleMapJson = JSON.parse(ckan.geoview.feature_style)
                    resourceLayer.styleMap = new OpenLayers.StyleMap(styleMapJson)
                }

                if (this.options.ol_config.hide_overlays &&
                    this.options.ol_config.hide_overlays.toLowerCase() == "true") {
                    resourceLayer.setVisibility(false);
                }

                this.map.addLayer(resourceLayer)
               
                // DELWP added loading gif for so the user knows something is happening - especially for long WFS loads                
                resourceLayer.events.register("loadstart",resourceLayer, function(){
                   var loadgif = jQuery('<img id="loadgif" src="http://'+window.location.hostname+'/img/loading.gif"/>');
                   loadgif.css({
                              "position": "absolute",
                              "bottom": "0",
                              "left": "0",
                              "z-index": 10000
                           });

                   loadgif.appendTo("#map");
                });
                var that = this;
                var bbox = resourceLayer.getDataExtent && resourceLayer.getDataExtent()
                if (bbox) {
                    if (this.map.getExtent()) this.map.getExtent().extend(bbox)
                    else this.map.zoomToExtent(bbox)
               
                    // DELWP remove load gif
                    resourceLayer.events.register("loadend",resourceLayer, function(e){
                        jQuery("#loadgif").remove();
                        that._addWarning(e);
                    });
                }
                else {
                    var firstExtent = false
                    resourceLayer.events.register(
                        "loadend",
                        resourceLayer,
                        function (e) {
                                                   
                            jQuery("#loadgif").remove(); // DELWP remove load gif
                            that._addWarning(e); // DELWP add warning if the wfs load fails
                            if (!firstExtent) {
                                var bbox = e && e.object && e.object.getDataExtent && e.object.getDataExtent()
                                if (bbox)
                                    if (this.map.getExtent()) this.map.getExtent().extend(bbox)
                                    else this.map.zoomToExtent(bbox)
                                else
                                    this.map.zoomToMaxExtent()
                                firstExtent = true
                            }
                        })
                }

            },
            // DELWP: Warning for content to large to be proxied 
            _addWarning: function(e){
               console.log(e);
               
               if(e.response && e.response.code == 0){
                           var string = "GeoJSON or KML";
                           var start = e.response.priv.responseText.indexOf("Content-Length: ");
                           var end = e.response.priv.responseText.indexOf(".",start);
                           var contentLength = parseInt(e.response.priv.responseText.substring(start+"Content-Length: ".length,end));
                           var warnbox = jQuery('<div id="mapWarnBox"></div>');
                           var wfswarn  = "Sorry, the features requested were over the 3MB limit, they were "+(contentLength/(1024*1024)).toFixed(1)+"MB, <i>zoom in</i> to restrict the amount features returned, or try the WMS preview.";
                           var filewarn = "Sorry, the file requested was over the 3MB limit, it was "+(contentLength/(1024*1024)).toFixed(1)+"MB, this file cannot be previewed on the map. Try the WMS preview.";
                           var isFile = ("GeoJSON or KML".indexOf(e.object.name) >= 0) ? true : false ;
                           //console.log(isFile,e.object.name);
                           warnbox.html(isFile ? filewarn : wfswarn);
                           warnbox.css({ //DELWP add css on the fly, better than creating more code in other places
                              "position": "absolute",
                              "margin": "auto",
                              "top": "30%",
                              "left": "50%",
                              "width": "30%",
                              "height": "15%",
                              "background-color": "rgba(0,0,0,0.5)",
                              "z-index": 10000,
                              "transform": "translate(-50%)",
                              "font-family": "Arial",
                              "font-weight": "bold",
                              "text-align": "center",
                              "color": "#fff",
                              "padding": "5px"
                           });
                           warnbox.appendTo("#map").delay(isFile ? 15000 : 6000).fadeOut(500,function(){this.remove()});
                        }


            },

            _commonBaseLayer: function(mapConfig) {
                /*
                Return an OpenLayers base layer to be used depending on CKAN wide settings

                TODO: factor out somewhere it can be reused by other modules.

                */

                var baseMapLayer;
                var urls;
                var attribution;

                var isHttps = window.location.href.substring(0, 5).toLowerCase() === 'https';
                if (mapConfig.type == 'mapbox') {
                    // MapBox base map
                    if (!mapConfig['mapbox.map_id'] || !mapConfig['mapbox.access_token']) {
                      throw '[CKAN Map Widgets] You need to provide a map ID ([account].[handle]) and an access token when using a MapBox layer. ' +
                            'See http://www.mapbox.com/developers/api-overview/ for details';
                    }

                    urls = ['//a.tiles.mapbox.com/v4/' + mapConfig['mapbox.map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['mapbox.access_token'],
                                '//b.tiles.mapbox.com/v4/' + mapConfig['mapbox.map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['mapbox.access_token'],
                                '//c.tiles.mapbox.com/v4/' + mapConfig['mapbox.map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['mapbox.access_token'],
                                '//d.tiles.mapbox.com/v4/' + mapConfig['mapbox.map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['mapbox.access_token'],
                    ];
                    attribution = '<a href="https://www.mapbox.com/about/maps/" target="_blank">&copy; Mapbox &copy; OpenStreetMap </a> <a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>';
                    baseMapLayer = new OpenLayers.Layer.XYZ('MapBox', urls, {
                        sphericalMercator: true,
                        wrapDateLine: true,
                        attribution: attribution
                    });
                } else if (mapConfig.type == 'custom') {
                    // Custom XYZ layer
                    urls = mapConfig['custom.url'];
                    if (urls.indexOf('${x}') === -1) {
                      urls = urls.replace('{x}', '${x}').replace('{y}', '${y}').replace('{z}', '${z}');
                    }
                    baseMapLayer = new OpenLayers.Layer.XYZ('Base Layer', urls, {
                        sphericalMercator: true,
                        wrapDateLine: true,
                        attribution: mapConfig.attribution
                    });
                } else if (mapConfig.type == 'vicmapapi512'){
			/* VICMAPAPI WMS 512  */
			/*	
			var url = "http://api.maps.vic.gov.au/geowebcacheWM/service/wms";
			baseMapLayer = new OpenLayers.Layer.WMS("VicmapAPI WMS",url,{
			   // url : url,
			   // name: "VicmapAPI WMS",
			    layers : "WEB_MERCATOR",
			   // div: "map",
			    format: "image/png",
			   // tiled: true,
			    style: '',
			   // isBaseLayer: true,
			   // opacity: 1,
			   // maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
			   // attribution: "Vicmap API © 2015 State Government of Victoria | <a href='http://api.maps.vic.gov.au/vicmapapi/Copyright.jsp' target='_blank' style='color:#4BABFA;'>Copyright and Disclaimer</a> " 
			},{
			   isBaseLayer : true 
			});	
			*/			
			/* VICMAPAPI WMTS 512 */
                        
					var matrixids = new Array(19);
					for (var i = 0; i <= 18; ++i) {
						matrixids[i] = "EPSG:3857_WEB_MERCATOR:" + i;
					}
					var url = "http://api.maps.vic.gov.au/geowebcacheWM/service/wmts";
					var  baseMapLayer = new OpenLayers.Layer.WMTS({
                        name: "Vicmap API",
						//sphericalMercator: true,
                        url: url,
                        layer: "WEB_MERCATOR",
                        div:"map",
                        matrixSet: "EPSG:3857_WEB_MERCATOR",
                       // ServerResolutions: [
					    ServerResolutions: [
                            156543.03392804097, 
                            78271.51696402048, 
                            39135.75848201024, 
                            19567.87924100510000, 
                            9783.93962050256000, 
                            4891.96981025128000, 
                            2445.98490512564000, 
                            1222.99245256282000, 
                            611.49622628141000, 
                            305.74811314070500, 
                            152.87405657035200, 
                            76.43702828517620, 
                            38.21851414258810, 
                            19.10925707129400, 
                            9.55462853564703, 
                            4.77731426782351, 
                            2.388657133911758, 
                            1.194328566955879, 
                            0.5971642834779395,  
                        ],
                        //tileSize: 512,
                        matrixIds: matrixids,
                        format: "image/png",
                        style: "_null",
                        opacity: 1,
                        isBaseLayer: true,
			tileFullExtent: new OpenLayers.Bounds(15359931,-6164655,17252630,-3765811),
                        maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
						attribution: this.options.map_config.attribution
					});
					//baseMapLayer.projection = baseMapLayer.projection;
					baseMapLayer.setTileSize(new OpenLayers.Size(512,512));
			

					
				} else {
                    // MapQuest OpenStreetMap base map
                    if (isHttps) {
                        var urls = ['//otile1-s.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png',
                                    '//otile2-s.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png',
                                    '//otile3-s.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png',
                                    '//otile4-s.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png'];

                    } else {
                        var urls = ['//otile1.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png',
                                    '//otile2.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png',
                                    '//otile3.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png',
                                    '//otile4.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png'];
                    }
                    var attribution = mapConfig.attribution || 'Map data &copy; OpenStreetMap contributors, Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="//developer.mapquest.com/content/osm/mq_logo.png">';

                    baseMapLayer = new OpenLayers.Layer.OSM('MapQuest OSM', urls, {
                      attribution: attribution});
                }

                return baseMapLayer;

            },

            _onReady: function () {

                // gather options and config for this view
                var proxyUrl = this.options.proxy_url;
                var proxyServiceUrl = this.options.proxy_service_url;
                if (this.options.resourceView)
                    $_.extend(ckan.geoview, JSON.parse(this.options.resourceView))

                ckan.geoview.gapi_key = this.options.gapi_key;

                // Choose base map based on CKAN wide config
		//var clearBaseLayer = new OpenLayers.Layer.OSM("None", this.options.site_url + "img/blank.gif", {isBaseLayer: true, attribution: ''});
		var clearBaseLayer = new OpenLayers.Layer.OSM("None", "http://"+window.location.hostname+"/img/blank.gif", {isBaseLayer: true, attribution: ''});
		
                var baseMapLayer = this._commonBaseLayer(this.options.map_config);
				baseMapLayer.projection = clearBaseLayer.projection; // DELWP use the projection from here, the clear layer will be overwritten
			//	baseMapLayer.tileOrigin = clearBaseLayer.tileOrigin;
				
               
                var mapDiv = $("<div></div>").attr("id", "map").addClass("map")
                var info = $("<div></div>").attr("id", "info")
                mapDiv.append(info)
                clearBaseLayer = new OpenLayers.Layer("None",{isBaseLayer: true,opacity: 0.5});  //DELWP overwrite the clear layer with one that works
                clearBaseLayer.projection = baseMapLayer.projection; // DELWP now steal the basemap layers projection
                $("#data-preview").empty()
                $("#data-preview").append(mapDiv)
          	//$(".olControlAttribution").css("font-family","Arial")

                info.tooltip({
                    animation: false,
                    trigger: 'manual',
                    placement: "right",
                    html: true
                });
				
				
				

                var eventListeners;
			//	console.log(this.options);
			//	console.log(ckan.geoview);
				var that = this;
		
                if ( (ckan.geoview && 'feature_hoveron' in ckan.geoview) ? ckan.geoview['feature_hoveron'] : this.options.ol_config.default_feature_hoveron)
                    eventListeners = {
                    featureover: function (e) {
                        e.feature.renderIntent = "select";
                        e.feature.layer.drawFeature(e.feature);
                        //var pixel = event.xy
                      /* info.css({  // DELWP remove this and repalce with one that works, and will work for every dataset
                           left: (pixel.x + 10) + 'px',
                            top: (pixel.y - 15) + 'px'
                        });
                        info.currentFeature = e.feature
                        info.tooltip('hide')
                            .empty()
                        var tooltip = "<div>" + (e.feature.data.name || e.feature.fid) + "</div><table>";
                         for (var prop in e.feature.data) tooltip += "<tr><td>" + prop + "</td><td>" + e.feature.data[prop] + "</td></tr></div>"
                        tooltip += "</table>"
                        info.attr('data-original-title', tooltip)
                            .tooltip('fixTitle')
                            .tooltip('show'); */
                    },
                    featureout: function (e) {
                        e.feature.renderIntent = "default"
                        e.feature.layer.drawFeature(e.feature)
                        if (info.currentFeature == e.feature) {
                            info.tooltip('hide')
                            info.currentFeature = undefined
                        }

                    },
                    featureclick: function (e) {
					//console.log("Map says: " + e.feature.id + " clicked on " + e.feature.layer.name +"|" + e.feature);
						console.log(that.map);
						//console.log(e.feature);
						//console.log(that.map.getLonLatFromPixel(event.xy));
						if(that.map.popups[0]){
							that.map.popups[0].destroy();
						}
						var feature = e.feature;
						var html = function(feature){
							//var heading = "<h2>"+feature.fid+"</h2>";
							//console.log(that.map);
							var atts;
                                                        var layertitle = feature.layer.title || feature.layer.name;
							if(feature.attributes){
								atts = "<table style='width: 95%'><th colspan='2'>"+ layertitle +"</th>"
								
								for (var att in feature.attributes){
									console.log(feature.attributes[att]);
									atts = atts + "<tr><td class='left'>"+att+"</td> <td class='right'>"+feature.attributes[att]+"</td></tr>"
								}
								atts = atts+"</table>"
							}
							console.log(atts);
							return "<div style='font-family: Arial'>"+atts+"</div>";
						};
                                                console.log(window);
                                                // console.log(event || e.object.events.click[1].obj.evt);
                                                //console.log('event' in window ? 'YES' : 'NO' );
                                                var ev = 'event' in window ? event : e.object.events.listeners.click[1].obj.evt;
						var popup = new OpenLayers.Popup.FramedCloud("pops",
							that.map.getLonLatFromPixel(ev.xy),
							null,
							true,
							null
						);
						popup.autoSize = false,
                                               // popup.maxSize = new OpenLayers.Size({h:260});
					    //popup.setSize = new OpenLayers.Size(400,800);
						popup.fixedRelativePosition = true;
						popup.closeOnMove = true;
						e.popup = popup;
						that.map.addPopup(popup);
						popup.setContentHTML(html(feature));
						
                    }
                }
				//this.map.addEventListener = eventListeners;
               // OpenLayers.ImgPath = this.options.site_url + 'js/vendor/openlayers2/img/';

                

                layerSwitcher = new OpenLayers.Control.CKANLayerSwitcher()
		console.log(layerSwitcher);		
				this.map = new OpenLayers.Map(
                    {
                        div: "map",
                       // theme: this.options.site_url + "js/vendor/openlayers2/theme/default/style.css",
                        layers: [baseMapLayer, clearBaseLayer],
                        maxExtent: baseMapLayer.getMaxExtent(),
                        eventListeners: eventListeners,
  			numZoomLevels: 19
						//restrictedExtent: new OpenLayers.Bounds(15663808,-4760130,16712820,-4017007)
                        //projection: OL_HELPERS.Mercator, // this is needed for WMS layers (most only accept 3857), but causes WFS to fail
                    });

                this.map.addControl(layerSwitcher);
    
		console.log(this.map)
                var bboxFrag;
                var fragMap = OL_HELPERS.parseKVP((window.parent || window).location.hash && (window.parent || window).location.hash.substring(1));

                var bbox = (fragMap.bbox && new OpenLayers.Bounds(fragMap.bbox.split(',')).transform(OL_HELPERS.EPSG4326, this.map.getProjectionObject()));
                if (bbox) this.map.zoomToExtent(bbox);
				
				//var tMap = this.map;

                var proxyUrl = this.options.proxy_url;
                var proxyServiceUrl = this.options.proxy_service_url;

                ckan.geoview.googleApiKey = this.options.gapi_key;
                //console.log(this.options);


                withLayers(preload_resource, proxyUrl, proxyServiceUrl, $_.bind(this.addLayer, this));

                // Expand layer switcher by default
               // layerSwitcher.maximizeControl();
		$(".olControlAttribution").css("font-family","Arial")
            }
        }
    });
})();
OpenLayers.ImgPath = '/js/vendor/openlayers2/img/';
