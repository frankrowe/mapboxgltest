var express = require('express')
var zlib = require('zlib')
var mapnik = require('mapnik')
mapnik.register_default_input_plugins();
var SphericalMercator = require('sphericalmercator')
var mercator = new SphericalMercator({
  size: 256 //tile size
})
var router = express.Router();
var pg = require('pg');
var conString = "postgres://fsrowe:password@localhost/fsrowe";

var VectorTile = require('vector-tile').VectorTile;
var Protobuf = require('pbf');

var makeWKTfromBounds = function(bounds){
  bounds.map(function(corner){
    return parseFloat(corner)
  })
  var wkt = 'POLYGON((' +
    bounds[0] + ' ' + bounds[1] + ', ' +
    bounds[0] + ' ' + bounds[3] + ', ' +
    bounds[2] + ' ' + bounds[3] + ', ' +
    bounds[2] + ' ' + bounds[1] + ', ' +
    bounds[0] + ' ' + bounds[1] + '))'
  return wkt
}

var toGeoJSON = function(json) {
  var geojson = {type: "FeatureCollection", features: []}
  json.forEach(function(feature) {
    var obj = {
      "type": "Feature",
      "properties": {},
      "geometry": JSON.parse(feature.geojson)
    }
    geojson.features.push(obj)
  })
  return geojson
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/vector-tiles/:layername/:z/:x/:y.mvt', function(req, res) {
  var bbox = mercator.bbox(
    +req.params.x,
    +req.params.y,
    +req.params.z,
    false,
    '4326'
  )
  var wkt = makeWKTfromBounds(bbox)
  var bounds = 'ST_GeometryFromText(\'' + wkt + '\', 4030)'
  var sql = 'select st_asgeojson(geometry) as geojson from zayo_duluth_to_st_paul'
  sql += ' where st_intersects(geometry, ' + bounds + ')'
  pg.connect(conString, function(err, client, done) {
    if(err) {
      return console.error('error fetching client from pool', err);
    }
    client.query(sql, [], function(err, result) {
      done()
      if(err) {
        res.end()
        return console.error('error running query', err)
      }
      if (result.rows.length) {
        var data = result.rows
      } else {
        var data = {}
      }
      var vtile = new mapnik.VectorTile(+req.params.z, +req.params.x, +req.params.y)
      vtile.addGeoJSON(JSON.stringify(toGeoJSON(result.rows)), 'fiber')
      res.setHeader('Content-Encoding', 'gzip')
      res.setHeader('Content-Type', 'application/x-protobuf')
      zlib.gzip(vtile.getData(), function(err, pbf) {
        res.send(pbf)
      })
    })
  })
})


module.exports = router
