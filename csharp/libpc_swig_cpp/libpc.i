/******************************************************************************
 *
 * Project:  libLAS - http://liblas.org - A BSD library for LAS format data.
 * Purpose:  swig/C# bindings for liblas
 * Author:   Michael P. Gerlek (mpg@flaxen.com)
 *
 ******************************************************************************
 * Copyright (c) 2011, Michael P. Gerlek (mpg@flaxen.com)
 *
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following 
 * conditions are met:
 * 
 *     * Redistributions of source code must retain the above copyright 
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright 
 *       notice, this list of conditions and the following disclaimer in 
 *       the documentation and/or other materials provided 
 *       with the distribution.
 *     * Neither the name of the Martin Isenburg or Iowa Department 
 *       of Natural Resources nor the names of its contributors may be 
 *       used to endorse or promote products derived from this software 
 *       without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS 
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE 
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, 
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, 
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS 
 * OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, 
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT 
 * OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY 
 * OF SUCH DAMAGE.
 ****************************************************************************/
 
%module libpc_swig_cpp

%{
#include <iostream>

#include "libpc/libpc_config.hpp"

#include "libpc/Bounds.hpp"
#include "libpc/Range.hpp"

#include "libpc/Dimension.hpp"
#include "libpc/DimensionLayout.hpp"
#include "libpc/Schema.hpp"
#include "libpc/SchemaLayout.hpp"
#include "libpc/PointData.hpp"

#include "libpc/Header.hpp"
#include "libpc/Stage.hpp"
#include "libpc/Filter.hpp"
#include "libpc/Reader.hpp"

#include "libpc/../../src/drivers/liblas/header.hpp"
#include "libpc/../../src/drivers/liblas/reader.hpp"
%}

%include "typemaps.i"

// C# support for std::string
%include "std_string.i"

// C# support for std::vector<T>
%include "std_vector.i"
namespace std {
   %template(VectorU8) vector<unsigned char>;
   %template(VectorU32) vector<unsigned int>;
};
 

// fix up some missing types
namespace std
{
    typedef unsigned int size_t;
};

%include "std/std_iostream.i"

namespace boost
{
    typedef unsigned char uint8_t;
    typedef signed char int8_t;
    typedef unsigned short uint16_t;
    typedef signed short int16_t;
    typedef unsigned int uint32_t;
    typedef signed int int32_t;
    typedef unsigned long long uint64_t;
    typedef signed long long int64_t;
};


namespace libpc
{

template <typename T>
class Range
{
public:
    typedef T value_type;

    Range();
    Range(T minimum, T maximum);
    T getMinimum() const;
    void setMinimum(T value);
    T getMaximum() const;
    void setMaximum(T value);
    bool equal(Range const& other) const;
    bool overlaps(Range const& r) const;
    bool contains(Range const& r) const;
    bool contains(T v) const;
    bool empty(void) const;
    void clip(Range const& r);
    void grow(T v);
    void grow(Range const& r);
    void grow(T lo, T hi);
    T length() const;
};

template <typename T>
class Bounds
{
public:
    Bounds( T minx,
            T miny,
            T minz,
            T maxx,
            T maxy,
            T maxz);
    Bounds(const Vector<T>& minimum, const Vector<T>& maximum);
    T getMinimum(std::size_t const& index) const;
    void setMinimum(std::size_t const& index, T v);
    T getMaximum(std::size_t const& index) const;
    void setMaximum(std::size_t const& index, T v);
    Vector<T> getMinimum();
    Vector<T> getMaximum();
    RangeVector const& dimensions() const;
    std::size_t size() const;
    bool equal(Bounds<T> const& other) const;
    bool overlaps(Bounds const& other) const;
    bool contains(Vector<T> point) const;
    bool contains(Bounds<T> const& other) const;
    void clip(Bounds const& r);
    void grow(Bounds const& r);
    void grow(Vector<T> const& point);
    T volume() const;
    bool empty() const;
};



class Dimension
{
public:
   enum Field
    {
        Field_INVALID = 0,
        Field_X,
        Field_Y,
        Field_Z,
        Field_Intensity,
        Field_ReturnNumber,
        Field_NumberOfReturns,
        Field_ScanDirectionFlag,
        Field_EdgeOfFlightLine,
        Field_Classification,
        Field_ScanAngleRank,
        Field_UserData,
        Field_PointSourceId,
        Field_GpsTime,
        Field_Red,
        Field_Green,
        Field_Blue,
        Field_WavePacketDescriptorIndex,
        Field_WaveformDataOffset,
        Field_ReturnPointWaveformLocation,
        Field_WaveformXt,
        Field_WaveformYt,
        Field_WaveformZt,
        // ...

        // add more here
        Field_User1 = 512,
        Field_User2,
        Field_User3,
        Field_User4,
        Field_User5,
        Field_User6,
        Field_User7,
        Field_User8,
        Field_User9,
        // ...
        // feel free to use your own int here

        Field_LAST = 1023
    };

    enum DataType
    {
        Int8,
        Uint8,
        Int16,
        Uint16,
        Int32,
        Uint32,
        Int64,
        Uint64,
        Float,       // 32 bits
        Double       // 64 bits
    };

public:
    Dimension(Field field, DataType type);
    static std::string getDataTypeName(DataType);
};


class DimensionLayout
{
public:
    DimensionLayout(const Dimension&);
    const Dimension& getDimension() const;
    inline std::size_t getByteOffset() const;
    inline void setByteOffset(std::size_t v);
    inline std::size_t getPosition() const;
    inline void setPosition(std::size_t v);
};

class Schema
{
public:
    typedef std::vector<Dimension> Dimensions;
    typedef std::vector<Dimension>::iterator DimensionsIter;
    typedef std::vector<Dimension>::const_iterator DimensionsCIter;

public:
    Schema();
    const Dimension& getDimension(std::size_t index) const;
    const Dimensions& getDimensions() const;
    bool hasDimension(Dimension::Field field) const;
    int getDimensionIndex(Dimension::Field field) const;
};

class SchemaLayout
{
public:
    typedef std::vector<DimensionLayout> DimensionLayouts;
    typedef std::vector<DimensionLayout>::iterator DimensionLayoutsIter;
    typedef std::vector<DimensionLayout>::const_iterator DimensionLayoutsCIter;

    SchemaLayout(const Schema&);
    const Schema& getSchema() const;
    std::size_t getByteSize() const;
    const DimensionLayout& getDimensionLayout(std::size_t index) const;
};


class PointData
{
public:
    typedef std::vector<boost::uint8_t> valid_mask_type;
    PointData(const SchemaLayout&, boost::uint32_t numPoints);
    boost::uint32_t getNumPoints() const;
    //boost::uint32_t getNumValidPoints();
    const SchemaLayout& getSchemaLayout() const;
    const Schema& getSchema() const;
    bool allValid() const;
    void setValid(valid_mask_type::size_type  pointIndex, bool value=true);
    template<class T> T getField(std::size_t pointIndex, std::size_t fieldIndex) const;
    template<class T> void setField(std::size_t pointIndex, std::size_t fieldIndex, T value);
    void copyPointsFast(std::size_t destPointIndex, std::size_t srcPointIndex, const PointData& srcPointData, std::size_t numPoints);
};




class Header
{
public:
    Header();
    const Schema& getSchema() const;
    boost::uint64_t getNumPoints() const;
    const Bounds<double>& getBounds() const;
    //const SpatialReference& getSpatialReference() const;
    //const Metadata::Array& getMetadata() const;
};

class Stage
{
public:
    Stage();
    virtual const std::string& getName() const = 0;
    boost::uint32_t read(PointData&);
    virtual void readBegin(boost::uint32_t numPointsToRead) = 0;
    virtual boost::uint32_t readBuffer(PointData&) = 0;
    virtual void readEnd(boost::uint32_t numPointsRead) = 0;
    virtual void seekToPoint(boost::uint64_t pointNum) = 0;
    virtual boost::uint64_t getCurrentPointIndex() const = 0;
    boost::uint64_t getNumPoints() const;
    bool atEnd() const;
    const Header& getHeader() const;
};


class Reader : public Stage
{
public:
    Reader(int);
    virtual void readBegin(boost::uint32_t numPointsToRead);

    virtual void readEnd(boost::uint32_t numPointsRead);

    virtual void seekToPoint(boost::uint64_t pointNum);

    virtual boost::uint64_t getCurrentPointIndex() const;
};


class LiblasHeader : public Header
{
public:
};


%feature("notabstract") LiblasReader;
class LiblasReader : public Reader
{
public:
    LiblasReader(std::istream&);
    ~LiblasReader();
    const libpc::LiblasHeader& getLiblasHeader() const;
    boost::int8_t getPointFormatNumber() const;
};

class Utils
{
public:
    static std::istream* openFile(std::string const& filename, bool asBinary=true);
    static void closeFile(std::istream* ifs);
};


}; // namespace
